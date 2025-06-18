
import mongoose, { Schema, Document, models, Model } from 'mongoose';
import type { IUser } from './User';
import type { IWorkspace } from './Workspace';
import type { ITask } from './Task';
import { ALL_OBJECTIVE_PRIORITIES, ObjectivePriority } from '@/types'; // Importar

export interface IObjective extends Document {
  description: string;
  userId: IUser['_id'];
  workspaceId: IWorkspace['_id'];
  tasks: ITask['_id'][];
  priority: ObjectivePriority; // Nuevo campo
  isArchived: boolean; // Nuevo campo
  createdAt: Date; // Mongoose gestiona esto con timestamps:true
}

const ObjectiveSchema: Schema<IObjective> = new Schema({
  description: {
    type: String,
    required: [true, 'Por favor, proporciona una descripción para este objetivo.'],
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
  priority: { // Nuevo campo
    type: String,
    enum: ALL_OBJECTIVE_PRIORITIES,
    default: 'Medium',
    required: true,
  },
  isArchived: { // Nuevo campo
    type: Boolean,
    default: false,
    required: true,
  },
}, { timestamps: true });

const Objective: Model<IObjective> = models.Objective || mongoose.model<IObjective>('Objective', ObjectiveSchema);

export default Objective;
