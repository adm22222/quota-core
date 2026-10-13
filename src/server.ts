import 'dotenv/config';
import app from './app.ts';

const server = app.listen(process.env.PORT || 3001, () => {
  console.log(`Server is running on port ${process.env.PORT || 3001}`);
});
