// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { Mongoose } from 'mongoose';

declare global {
  // eslint-disable-next-line no-var
  var mongooseConnection: {
    conn: Mongoose | null;
    promise: Promise<Mongoose> | null;
  };
}

export {}; // This makes the file a module