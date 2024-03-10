# notify_rakuten_card_usage
## 概要
- 楽天カードの利用状況を通知する

## 利用方法
```sh
npm run build
node src\dist\App\Adapter\Cli\FetchRakutenCardTransactions.js
```
注意：一度しか実行されないため、定期実行には別途ほかのシステムを利用する必要がある

## 今後の動向
- 依存関係の調整を行いより汎用的に利用できるようにする