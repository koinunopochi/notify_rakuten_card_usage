import Transaction from '../Model/Transaction';
import TransactionDate from '../ValueObject/TransactionDate';

// トランザクションリポジトリのインターフェース
interface ITransactionRepository {
  save(transaction: Transaction): Promise<void>;
  findByDateRange(
    startDate: TransactionDate,
    endDate: TransactionDate
  ): Promise<Transaction[]>;
}

export default ITransactionRepository;
