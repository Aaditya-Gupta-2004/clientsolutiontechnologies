import sys
import os
import urllib.parse
from sqlalchemy import create_engine, MetaData, text

# Ensure backend directory is in path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from database import Base
from models.user import User
from models.document import Document
from models.payment import Payment
from config import get_settings

def migrate():
    print("Starting Migration from Local DB to Supabase...")
    settings = get_settings()
    
    local_db_url = settings.database_url
    if local_db_url.startswith("postgresql://") and "+psycopg" not in local_db_url:
        local_db_url = local_db_url.replace("postgresql://", "postgresql+psycopg://", 1)

    # Use URL-encoded password for Supabase
    password = 'XXeF@+7/@*RGT?e'
    encoded_password = urllib.parse.quote_plus(password)
    # Use the Direct Connection (port 5432) for creating tables and migrating
    supabase_url = f'postgresql+psycopg://postgres.bjafatqaimbsqfkpfuje:{encoded_password}@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres'

    print(f"Connecting to Local DB: {local_db_url.split('@')[1]}")
    local_engine = create_engine(local_db_url)
    
    print(f"Connecting to Supabase DB: {supabase_url.split('@')[1]}")
    supabase_engine = create_engine(supabase_url)

    # Create all tables in Supabase
    print("Creating tables in Supabase...")
    Base.metadata.create_all(bind=supabase_engine)

    # Reflect tables
    metadata = MetaData()
    metadata.reflect(bind=local_engine)
    
    tables_to_migrate = [
        metadata.tables['users'],
        metadata.tables['documents'],
        metadata.tables['payments']
    ]

    with local_engine.connect() as local_conn:
        with supabase_engine.begin() as supabase_conn:
            for table in tables_to_migrate:
                print(f"Migrating table: {table.name}...")
                # Fetch all data from local
                result = local_conn.execute(table.select()).fetchall()
                if not result:
                    print(f" - Table {table.name} is empty. Skipping.")
                    continue
                
                # We need to map row values to dicts for insert
                columns = [col.name for col in table.columns]
                data_to_insert = []
                for row in result:
                    row_dict = {}
                    for idx, col in enumerate(columns):
                        row_dict[col] = row[idx]
                    data_to_insert.append(row_dict)
                
                # Delete existing data in remote table to avoid conflict
                supabase_conn.execute(table.delete())
                
                # Insert all data
                supabase_conn.execute(table.insert(), data_to_insert)
                
                # Reset sequence (PostgreSQL specific) so future inserts don't fail with unique constraint
                seq_name = f"{table.name}_id_seq"
                try:
                    supabase_conn.execute(text(f"SELECT setval('{seq_name}', COALESCE((SELECT MAX(id)+1 FROM {table.name}), 1), false);"))
                except Exception as e:
                    print(f" - Warning: Could not reset sequence for {table.name}: {e}")
                
                print(f" - Successfully migrated {len(data_to_insert)} rows for {table.name}.")

    print("\n✅ Migration complete! You can now switch your .env DATABASE_URL to the Supabase Transaction Pooler URL.")

if __name__ == "__main__":
    migrate()
