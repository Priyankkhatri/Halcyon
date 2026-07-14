import asyncio
from sqlalchemy import delete
from database import AsyncSessionLocal, Incident, IncidentTag, SimilarIncidentRef, DecisionLog

async def main():
    async with AsyncSessionLocal() as db:
        print("Clearing historical incident data...")
        await db.execute(delete(DecisionLog))
        await db.execute(delete(SimilarIncidentRef))
        await db.execute(delete(IncidentTag))
        await db.execute(delete(Incident))
        await db.commit()
        print("Database reset complete! Incidents cleared.")

if __name__ == "__main__":
    asyncio.run(main())
