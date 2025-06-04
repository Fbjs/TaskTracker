
import mongoose, { Schema, Document, models, Model } from 'mongoose';

export interface IUser extends Document {
  email: string;
  password?: string; // Password field is optional on the interface for flexibility, but required in schema
  // Mongoose asignará automáticamente _id, createdAt, updatedAt
}

const UserSchema: Schema<IUser> = new Schema({
  email: {
    type: String,
    required: [true, 'Please provide an email for this user.'],
    unique: true,
    match: [/.+\@.+\..+/, 'Please fill a valid email address'],
    trim: true,
    lowercase: true,
  },
  password: { 
    type: String, 
    required: [true, 'Please provide a password.'],
    minlength: [6, 'Password must be at least 6 characters long.'],
  }, 
}, { timestamps: true });

const User: Model<IUser> = models.User || mongoose.model<IUser>('User', UserSchema);

export default User;
