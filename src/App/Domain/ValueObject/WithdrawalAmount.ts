class WithdrawalAmount {
  private readonly _amount: number;

  constructor(amount: number) {
    if (amount <= 0) {
      throw new Error('値は0より大きくなければなりません');
    }
    this._amount = amount;
  }

  public value(): number {
    return this._amount;
  }
}

export default WithdrawalAmount;
