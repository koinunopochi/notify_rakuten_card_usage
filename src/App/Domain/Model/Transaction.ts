import TransactionDate from '../ValueObject/TransactionDate';
import WithdrawalAmount from '../ValueObject/WithdrawalAmount';

class Transaction {
  private readonly _date: TransactionDate;
  private readonly _amount: WithdrawalAmount;

  constructor(date: TransactionDate, amount: WithdrawalAmount) {
    this._date = date;
    this._amount = amount;
  }

  public value(): { date: TransactionDate; amount: WithdrawalAmount } {
    return {
      date: this._date,
      amount: this._amount,
    };
  }
}

export default Transaction;
