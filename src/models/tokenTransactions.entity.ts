import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

// transaction_hash
// address
// block_timestamp
// block_number
// block_hash
// to_address
// from_address
// value

@Entity({ name: 'module_web3_wallet_token_transactions' })
export class TokenTransactions {
  @Column({
    type: 'text',
    unique: true,
    name: 'transaction_hash',
  })
  transactionHash: string;

  @Column({
    type: 'text',
    name: 'from_address',
  })
  fromAddress: string;

  @Column({
    type: 'text',
    name: 'to_address',
  })
  toAddress: string;

  @Column({
    type: 'text',
    name: 'block_number',
  })
  blockNumber: string;

  @Column({
    type: 'text',
  })
  value: string;

  @Column({
    type: 'text',
    default: 'received',
  })
  status: string;

  @Column({
    type: 'text',
    unique: true,
    nullable: true,
    name: 'transaction_hash_matic',
  })
  transactionHashMatic: string;

  @Column({
    type: 'text',
    unique: true,
    nullable: true,
    name: 'transaction_hash_deposit',
  })
  transactionHashDeposit: string;

  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  isArchived: boolean;

  @CreateDateColumn({ type: 'datetime', default: () => 'NOW' })
  createDateTime: Date;

  @Column({ type: 'varchar', length: 300, nullable: true })
  createdBy: string;

  @UpdateDateColumn({ type: 'datetime', default: () => 'NOW' })
  lastChangedDateTime: Date;

  @Column({ type: 'varchar', length: 300, nullable: true })
  lastChangedBy: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  internalComment: string | null;
}
