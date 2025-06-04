
import mongoose, { Schema, Document, models, Model } from 'mongoose';
import type { IUser } from './User'; // For type referencing

export interface IWorkspace extends Document {
  name: string;
  ownerId: IUser['_id']; 
  memberIds?: IUser['_id'][];
}

const WorkspaceSchema: Schema<IWorkspace> = new Schema({
  name: {
    type: String,
    required: [true, 'Please provide a name for this workspace.'],
    trim: true,
  },
  ownerId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  memberIds: [{
    type: Schema.Types.ObjectId,
    ref: 'User',
  }],
}, { timestamps: true });

const Workspace: Model<IWorkspace> = models.Workspace || mongoose.model<IWorkspace>('Workspace', WorkspaceSchema);

export default Workspace;
