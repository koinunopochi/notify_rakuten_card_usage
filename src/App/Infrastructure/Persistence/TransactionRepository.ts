import ITransactionRepository from '../../Domain/Interfaces/ITransactionRepository';
import Transaction from '../../Domain/Model/Transaction';
import TransactionDate from '../../Domain/ValueObject/TransactionDate';
import WithdrawalAmount from '../../Domain/ValueObject/WithdrawalAmount';
import TransactionModel from './Mongoose/Schemas/TransactionSchema';

class TransactionRepository implements ITransactionRepository {
  
  async save(transaction: Transaction): Promise<void> {
    const date = transaction.value().date.value();
    const amount = transaction.value().amount.value();
    const transactionModel = new TransactionModel({ date, amount });
    transactionModel.save();
  }

  async findByDateRange(startDate: TransactionDate, endDate: TransactionDate): Promise<Transaction[]> {
    const transactions = await TransactionModel.find({
      date: {
        $gte: startDate.value(),
        $lte: endDate.value(),
      },
    });
    return transactions.map((transaction) => {
      return new Transaction(
        new TransactionDate(transaction.date),
        new WithdrawalAmount(transaction.amount)
      );
    });
  }
}

export default TransactionRepository;
