import { FastifyInstance } from "fastify";
import { initORM, Services } from "../../db.js";
import { Person } from "./person.entity.js";
import { PersonDto } from "./person.dto.js";
import { Source } from "./source/source.entity.js";
import { NotFoundError } from "@mikro-orm/sqlite";
import * as process from "node:process";
import { Nickname } from "./nickname/nickname.entity.js";
import { UUID } from "node:crypto";
import { FullName } from "./fullName/full-name.entity.js";

/**
 * Get people markers by query params, all available filters are:
 * - `category` [**optional**] - filter by category, must be delimited by `,` (comma); e.g. `&category=MAJANDUS,TEADUS`
 * - `subCategory` [**optional**] - filter by sub category, must be delimited by `,` (comma); e.g. `&subCategory=ehitus,kirjanuds`
 * - `dateOfBirthStart` [**optional**] - filter by date of birth time range start, provide only year as `yyyy`; e.g. `&dateOfBirthStart=1850`
 * - `dateOfBirthEnd` [**optional**] - filter by date of birth time range end, provide only year as `yyyy`; e.g. `&dateOfBirthEnd=1900`
 * - `name` [**optional**] - filter by name as well; e.g. `&name=kädi`
 *
 * TODO if name is used then it should prob return all data, no?
 *
 * @example
 * curl -X GET "http://localhost:3001/person/markers?category=MAJANDUS,KULTUUR&subCategory=ehitus,transport,tehnikateadused&name=nikolai" \
 *      -H "Accept: application/json"
 */
export async function registerPersonRoutes(
  app: FastifyInstance
): Promise<void> {
  const db: Services = await initORM();

  app.get("/", async (request, reply) => {
    try {
      const people: Person[] = await db.person.findAll({
        populate: ["nicknames", "categories", "sources", "subCategories"],
      });

      return reply.status(200).send(people);
    } catch (e) {
      reply.status(404).send({ message: "no people found!" });
    }
  });

  app.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: UUID };
    try {
      const person: Person = await db.person.findOneOrFail(
        { id },
        {
          populate: [
            "nicknames",
            "categories.name",
            "sources",
            "subCategories",
          ],
        }
      );

      return reply.status(200).send(person);
    } catch (error) {
      return reply.status(404).send({ message: "Person not found!" });
    }
  });

  app.get("/search", async (request, reply) => {
    const { name } = request.query as { name: string };

    try {
      const searchTerm = `%${name.toLowerCase()}%`;

      //sadly sqlite doesn't support $ilike, so can't use it here, yikes..
      const query = `
        SELECT
          person.x_coordinate as xCoordinate,
          person.y_coordinate as yCoordinate,
          person.first_name AS firstName,
          person.last_name AS lastName,
          GROUP_CONCAT(nickname.nickname, ', ') AS nicknames
        FROM person
               LEFT JOIN nickname ON person.id = nickname.person_id
        WHERE
          LOWER(person.first_name) LIKE ?
           OR LOWER(person.last_name) LIKE ?
           OR LOWER(nickname.nickname) LIKE ?
        GROUP BY person.id
          LIMIT 15;
      `;

      const results = await db.em.getConnection().execute(query, [searchTerm, searchTerm, searchTerm])

      const simplifiedPersons = results.map((row) => ({
        xCoordinate: row.xCoordinate,
        yCoordinate: row.yCoordinate,
        title: `${row.firstName} ${row.lastName}`,
      }))

      return reply.status(200).send(simplifiedPersons);
    } catch (e) {
      console.error("Error in /person/name route:", e);
      reply.status(500).send({ message: "Server error while fetching " });
    }
  });

  /**
   * DO NOT **fucking** touch this aight?!
   */
  app.post("/", async (request, reply) => {
    const apiKey: string | undefined = request.headers["x-api-key"] as string;
    if (!apiKey) {
      app.log.warn(
        `Request made for saving a person, but no API key was provided!`,
        request.ip,
        request.id
      );
      reply.status(400).send({ message: `Please provide an API key!` });
      return;
    } else {
      if (apiKey !== process.env.X_API_KEY) {
        app.log.warn(
          `Wrong API key provided for saving a person route!`,
          request.ip,
          request.id
        );
        reply.status(403).send({
          message: `Wrong API key provided, unauthorized access attempt!`,
        });
        return;
      }
    }

    const personDto: PersonDto = request.body as PersonDto;

    const person: Person = db.person.create(
      new Person({
        lastName: personDto.lastName,
        firstName: personDto.firstName ? personDto.firstName : undefined,
        dateOfBirth: personDto.dateOfBirth ? personDto.dateOfBirth : undefined,
        birthplace: personDto.birthplace,
        dateOfDeath: personDto.dateOfDeath ? personDto.dateOfDeath : undefined,
        description: personDto.description,
        occupation: personDto.occupation ? personDto.occupation : undefined,
        xCoordinate: personDto.xCoordinate,
        yCoordinate: personDto.yCoordinate,
      })
    );

    if (personDto.fullNames && personDto.fullNames.length > 0) {
      personDto.fullNames.map((fullName) => {
        person.fullNames.add(new FullName(fullName, person));
      });
    }

    if (personDto.nicknames && personDto.nicknames.length > 0) {
      personDto.nicknames.map((nickname) => {
        person.nicknames.add(new Nickname(nickname, person));
      });
    }

    try {
      const categories = await db.category.find({
        name: { $in: personDto.categories },
      });
      person.categories.add(categories);
    } catch (e) {
      const notFoundError: boolean = e instanceof NotFoundError;
      app.log.error(
        `An error has occurred while fetching categories from the database via user provided categories: ${personDto.categories}\nError: ${e}`
      );
      reply
        .code(notFoundError ? 404 : 500)
        .type("application/json")
        .send({
          error: `Internal Server Error saving person for the following categories: ${personDto.subCategories}\ne: ${e}`,
        });
      return;
    }

    if (personDto.subCategories && personDto.subCategories.length > 0) {
      try {
        const subCategories = await db.subCategory.find({
          name: { $in: personDto.subCategories },
        });
        person.subCategories.add(subCategories);
      } catch (e) {
        const notFoundError: boolean = e instanceof NotFoundError;
        app.log.error(
          `An error has occurred while fetching sub categories from the database via user provided subCategories: ${personDto.subCategories}\nError: ${e}`
        );
        reply
          .code(notFoundError ? 404 : 500)
          .type("application/json")
          .send({
            error: `Internal Server Error saving person for the following sub categories: ${personDto.subCategories}\ne: ${e}`,
          });
        return;
      }
    }

    personDto.sources.map((source) => {
      const newSource: Source = new Source(
        person,
        Source.getSourceType(source.sourceType),
        source.source
      );
      if (source.location) newSource.location = source.location;
      person.sources.add(newSource);
    });

    try {
      await db.em.flush();
    } catch (e) {
      app.log.error(
        `An error has occurred while flushing the changes made for the person to be inserted to db: ${person}\nError: ${e}`
      );
      reply
        .code(500)
        .type("application/json")
        .send({
          error: `Internal Server Error saving person for the following sub categories: ${personDto.subCategories}\ne: ${e}`,
        });
      return;
    }
  });

  app.get("/markers", async (request, reply) => {
    const { category, subcategory, dateOfBirthStart, dateOfBirthEnd, name } =
      request.query as {
        category?: string;
        subcategory?: string;
        dateOfBirthStart?: string;
        dateOfBirthEnd?: string;
        name?: string;
      };

    try {
      const queryBuilder = db.person
        .createQueryBuilder("person")
        .select([
          "person.id",
          "person.firstName",
          "person.lastName",
          "person.occupation",
          "person.dateOfBirth",
          "person.dateOfDeath",
          "person.xCoordinate",
          "person.yCoordinate",
          "person.description",
        ])
        .leftJoinAndSelect("person.nicknames", "nicknames")
        .leftJoinAndSelect("person.categories", "categories")
        .leftJoinAndSelect("person.subCategories", "sub_categories");

      if (category && category.trim() !== "") {
        const categories: string[] = category
          .split(",")
          .map((cat) => cat.trim());
        // console.debug("Applying category filter:", categories);
        queryBuilder.andWhere("categories.name IN (?)", [categories]);
      }

      if (subcategory && subcategory.trim() !== "") {
        const subCategories: string[] = subcategory
          .split(",")
          .map((subCat) => subCat.trim());
        // console.debug("Applying subCategory filter:", subCategories);
        queryBuilder.andWhere("sub_categories.name IN (?)", [subCategories]);
      }

      if (dateOfBirthStart || dateOfBirthEnd) {
        let condition: string = "";
        const params: any[] = [];

        if (dateOfBirthStart) {
          condition += `CAST(SUBSTR(person.date_of_birth, -4, 4) AS INTEGER) >= ?`;
          params.push(parseInt(dateOfBirthStart, 10));
        }
        if (dateOfBirthEnd) {
          if (condition) condition += " AND ";
          condition += `CAST(SUBSTR(person.date_of_birth, -4, 4) AS INTEGER) <= ?`;
          params.push(parseInt(dateOfBirthEnd, 10));
        }

        if (condition) {
          queryBuilder.andWhere(condition, params);
        }
      }

      const persons: Person[] = await queryBuilder.getResultList();

      const simplifiedPersons = persons.map((person) => ({
        id: person.id,
        occupation: person.occupation,
        dateOfBirth: person.dateOfBirth,
        dateOfDeath: person.dateOfDeath,
        xCoordinate: person.xCoordinate,
        yCoordinate: person.yCoordinate,
        title: person.firstName
          ? `${person.firstName} ${person.lastName}` // If firstname exists in pop-up
          : person.lastName, // If firstname doesnt exist in pop-up
        description: person.description,
        nicknames: person.nicknames.map((nickname) => nickname.nickname), // Assuming `nickname.name` exists
        categories: person.categories.map((category) => category.name), // Assuming `category.name` exists
        subCategories: person.subCategories.map((subCategory) => subCategory.name), // Assuming `subCategory.name` exists
      }));

      console.log(simplifiedPersons.slice(0, 10))

      return reply.status(200).send(simplifiedPersons);
    } catch (e) {
      console.error("Error in /person/search route:", e);
      reply.status(500).send({
        message: `Server error while fetching people based on the following filters: `,
      });
    }
  });
}
