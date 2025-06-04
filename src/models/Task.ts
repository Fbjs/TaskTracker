
import mongoose, { Schema, Document, models, Model } from 'mongoose';
import { ALL_TASK_STATUSES, ALL_TASK_PRIORITIES, TaskStatus, TaskPriority } from '@/types';
// import type { IUser } from './User'; // If assignee becomes a User ref
import type { IObjective } from './Objective';

export interface ITask extends Document {
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: Date;
  assignee?: string; // Could be ObjectId ref: 'User' in the future
  objectiveId: IObjective['_id'];
}

const TaskSchema: Schema<ITask> = new Schema({
  description: {
    type: String,
    required: [true, 'Please provide a description for this task.'],
    trim: true,
  },
  status: {
    type: String,
    enum: ALL_TASK_STATUSES,
    default: 'To Do',
    required: true,
  },
  priority: {
    type: String,
    enum: ALL_TASK_PRIORITIES,
    default: 'Medium',
    required: true,
  },
  dueDate: {
    type: Date,
  },
  assignee: {
    type: String, // For simplicity now, can be upgraded to ObjectId ref: 'User'
    trim: true,
  },
  objectiveId: {
    type: Schema.Types.ObjectId,
    ref: 'Objective',
    required: true,
  },
}, { timestamps: true });

const Task: Model<ITask> = models.Task || mongoose.model<ITask>('Task', TaskSchema);

export default Task;
