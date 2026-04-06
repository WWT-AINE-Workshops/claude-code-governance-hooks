import { buildControlPlane } from './app';

const app = buildControlPlane({ logger: true });
const port = Number(process.env.PORT ?? 3002);

app.listen({ port, host: '127.0.0.1' }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
