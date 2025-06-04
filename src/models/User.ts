
import mongoose, { Schema, Document, models, Model } from 'mongoose';

export interface IUser extends Document {
  email: string;
  // Mongoose asignará automáticamente _id, createdAt, updatedAt
}

const UserSchema: Schema<IUser> = new Schema({
  email: {
    type: String,
    required: [true, 'Please provide an email for this user.'],
    unique: true,
    match: [/.+\@.+\..+/, 'Please fill a valid email address'],
  },
  // password: { type: String, required: true }, // Consider hashing passwords in a real app
}, { timestamps: true });

const User: Model<IUser> = models.User || mongoose.model<IUser>('User', UserSchema);

export default User;
