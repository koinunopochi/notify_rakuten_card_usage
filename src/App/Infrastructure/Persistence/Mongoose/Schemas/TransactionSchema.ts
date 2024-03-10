import mongoose, { Schema, Document } from 'mongoose';

interface ITransaction extends Document {
  date: Date;
  amount: number;
}

const TransactionSchema: Schema = new Schema({
  date: { type: Date, required: true },
  amount: { type: Number, required: true },
});

const TransactionModel = mongoose.model<ITransaction>(
  'Transaction',
  TransactionSchema
);

export default TransactionModel;
