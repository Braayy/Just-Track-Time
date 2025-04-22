import initSqlJs, { Database } from "sql.js";
import TimeTrackerPlugin from "./main";
import { join } from "path";
import { Tracking } from "./types";
import { formatTimeSQL, formatUTCTimeSQL } from "./utils";

export class TrackingDatabase {
  private database: Database;

  constructor(
    private plugin: TimeTrackerPlugin,
    private databaseFilename: string
  ) { }

  public async init(wasmModuleFilename: string): Promise<void> {
    const wasmModulePath = join(this.plugin.manifest.dir || "", wasmModuleFilename);
    const databasePath = join(this.plugin.manifest.dir || "", this.databaseFilename);

    const moduleExists = await this.plugin.app.vault.adapter.exists(wasmModulePath);

    let wasmBlob: ArrayBuffer;

    if (!moduleExists) {
      const response = await fetch(`https://sql.js.org/dist/${wasmModuleFilename}`);
      const data = await response.arrayBuffer();

      wasmBlob = data;

      await this.plugin.app.vault.adapter.writeBinary(wasmModulePath, data);
    } else {
      wasmBlob = await this.plugin.app.vault.adapter.readBinary(wasmModulePath);
    }

    const SQL = await initSqlJs({
      wasmBinary: wasmBlob,
    });

    try {
      const data = await this.plugin.app.vault.adapter.readBinary(databasePath);
      this.database = new SQL.Database(Buffer.from(data));
    } catch (err) {
      this.database = new SQL.Database();
    }

    this.database.run("CREATE TABLE IF NOT EXISTS tracking(id INTEGER PRIMARY KEY, description TEXT NOT NULL, startTime TEXT NOT NULL, endTime TEXT)");
    await this.save();
  }

  public async save(): Promise<void> {
    if (!this.database) return;

    const databasePath = join(this.plugin.manifest.dir || "", this.databaseFilename);

    const data = this.database.export().buffer;
    await this.plugin.app.vault.adapter.writeBinary(databasePath, data);
  }

  public fetchTrackings(startPeriod: Date, endPeriod: Date | null): Tracking[] {
    const cleanStartPeriod = new Date(startPeriod);
    cleanStartPeriod.setUTCHours(0, 0, 0);

    let cleanEndPeriod: Date;

    if (endPeriod) {
      cleanEndPeriod = new Date(endPeriod);
      cleanEndPeriod.setUTCHours(0, 0, 0);
    } else {
      cleanEndPeriod = new Date(startPeriod);
      cleanEndPeriod.setUTCHours(0, 0, 0);
      cleanEndPeriod.setUTCDate(cleanEndPeriod.getUTCDate() + 1);
    }

    const result = this.database?.exec(`
      SELECT
        id,
        description,
        UNIXEPOCH(startTime) * 1000,
        UNIXEPOCH(endTime) * 1000
      FROM
        tracking
      WHERE
        startTime >= :startPeriod
        AND
        startTime < :endPeriod
      ORDER BY
        startTime
    `, {
      ":startPeriod": formatUTCTimeSQL(cleanStartPeriod),
      ":endPeriod": formatUTCTimeSQL(cleanEndPeriod),
    });

    if (!result) {
      this.database.handleError();
      return [];
    }

    const selectResult = result[0];

    if (!selectResult) {
      return [];
    }

    const rows = selectResult.values;

    return rows
      .map((row) => ({
        id: row[0] as number,
        description: row[1] as string,
        startTime: new Date(row[2] as number),
        endTime: row[3] ? new Date(row[3] as number) : null,
      }));
  }

  public createTracking(description: string) {
    this.database.run(`
      INSERT INTO
        tracking
      VALUES
        (NULL, :description, DATETIME(), NULL)
    `, {
      ":description": description
    });
  }

  public updateTracking(id: number, description: string, startTime: string | Date, endTime: string | Date | null) {
    const tStartTime = typeof startTime === "string" ? startTime : formatTimeSQL(startTime);
    const tEndTime = endTime === null ? null : typeof endTime === "string" ? endTime : formatTimeSQL(endTime);

    const query = tEndTime
      ? `
        UPDATE
          tracking
        SET
          description = :description,
          startTime = DATETIME(:startTime, 'utc'),
          endTime = DATETIME(:endTime, 'utc')
        WHERE
          id = :id
      `
      : `
        UPDATE
          tracking
        SET
          description = :description,
          startTime = DATETIME(:startTime, 'utc'),
          endTime = NULL
        WHERE
          id = :id
      `;

    this.database.run(query, {
      ":description": description,
      ":startTime": tStartTime,
      ":endTime": tEndTime,
      ":id": id,
    });
  }

  public endLastTracking() {
    this.database.run(`
      UPDATE
        tracking
      SET
        endTime = DATETIME()
      WHERE
        id = (
          SELECT
            id
          FROM
            tracking
          WHERE
            endTime IS NULL
          ORDER BY
            startTime DESC
          LIMIT 1
        );
    `);
  }

  public deleteTracking(id: number) {
    this.database.run(`
      DELETE FROM tracking WHERE id = :id
    `, {
      ":id": id,
    });
  }
}
