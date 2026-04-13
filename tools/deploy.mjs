// A stand-in for the team's deploy. It never deploys anything: it only says what it would do.
const dryRun = process.argv.includes('--dry-run');
const target = process.argv.find((a) => a.startsWith('--env='))?.slice(6) ?? 'staging';
console.log(`${dryRun ? '[dry run] ' : ''}Deploying Tasklane to ${target}...`);
console.log(
  dryRun
    ? '[dry run] Nothing was changed.'
    : 'Deployed. (Workshop stand-in: nothing left this laptop.)',
);
