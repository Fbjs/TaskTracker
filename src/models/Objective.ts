
import mongoose, { Schema, Document, models, Model } from 'mongoose';
import type { IUser } from './User';
import type { IWorkspace } from './Workspace';
import type { ITask } from './Task';

export interface IObjective extends Document {
  description: string;
  userId: IUser['_id'];
  workspaceId: IWorkspace['_id'];
  tasks: ITask['_id'][];
}

const ObjectiveSchema: Schema<IObjective> = new Schema({
  description: {
    type: String,
    required: [true, 'Please provide a description for this objective.'],
    trim: true,
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  workspaceId: {
    type: Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
  },
  tasks: [{
    type: Schema.Types.ObjectId,
    ref: 'Task',
  }],
}, { timestamps: true });

const Objective: Model<IObjective> = models.Objective || mongoose.model<IObjective>('Objective', ObjectiveSchema);

export default Objective;
