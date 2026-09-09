import sqlite3


DATABASE_NAME = "sentinelai.db"


def get_connection():
    connection = sqlite3.connect(DATABASE_NAME)
    connection.row_factory = sqlite3.Row
    return connection


def create_table():

    connection = get_connection()

    cursor = connection.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS incidents (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            type TEXT,
            camera TEXT,
            zone TEXT,

            person_id INTEGER,

            movement TEXT,

            duration REAL,

            risk_score INTEGER,

            risk_level TEXT,

            created_at TEXT,

            status TEXT

        )
    """)

    connection.commit()

    connection.close()