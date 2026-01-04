import { prisma } from "../lib/prisma";
import { US_STATES } from "../lib/us-states";

async function main() {
  await prisma.state.createMany({
    data: US_STATES,
    skipDuplicates: true
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
