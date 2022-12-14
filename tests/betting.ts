import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { Betting } from "../target/types/betting";

const {
  SystemProgram,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
  clusterApiUrl,
  SYSVAR_RENT_PUBKEY,
  SYSVAR_CLOCK_PUBKEY,
  Transaction,
  sendAndConfirmTransaction,
} = anchor.web3;

import keypair1 from "../id.json";
import keypair2 from "../id2.json";
import keypair3 from "../id3.json";
import { BN } from "bn.js";

const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

enum Winner {
  Left,
  Right,
}

describe("betting", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Betting as Program<Betting>;

  it("Is initialized!", async () => {
    // Add your test here.
    const provider = anchor.AnchorProvider.env();
    // for devnet signers
    const signer1 = Keypair.fromSecretKey(Uint8Array.from(keypair1));
    const signer2 = Keypair.fromSecretKey(Uint8Array.from(keypair2));
    const signer3 = Keypair.fromSecretKey(Uint8Array.from(keypair3));

    // for testnet signers
    // let signer1 = Keypair.generate();
    // let signer2 = Keypair.generate();
    // let signer3 = Keypair.generate();

    const AIRDROP_AMOUNT = 10000000000;

    // local test airdrop
    // await provider.connection.confirmTransaction(
    //   await provider.connection.requestAirdrop(
    //     signer1.publicKey,
    //     AIRDROP_AMOUNT
    //   ),
    //   "confirmed"
    // );
    // await provider.connection.confirmTransaction(
    //   await provider.connection.requestAirdrop(
    //     signer2.publicKey,
    //     AIRDROP_AMOUNT
    //   ),
    //   "confirmed"
    // );
    // await provider.connection.confirmTransaction(
    //   await provider.connection.requestAirdrop(
    //     signer3.publicKey,
    //     AIRDROP_AMOUNT
    //   ),
    //   "confirmed"
    // );

    let [battlePDA] = await PublicKey.findProgramAddress(
      [Buffer.from("battle"), signer1.publicKey.toBuffer()],
      program.programId
    );
    console.log("battlePDA = ", battlePDA.toBase58());

    let [escrowPDA] = await PublicKey.findProgramAddress(
      [Buffer.from("escrow"), signer1.publicKey.toBuffer()],
      program.programId
    );

    let slot = await provider.connection.getSlot("finalized");
    let time = await provider.connection.getBlockTime(slot);
    console.log("time = ", time);

    // create battle
    await provider.connection.confirmTransaction(
      await program.rpc.createBattle(new BN(time), new BN(time + 100), {
        accounts: {
          authority: signer1.publicKey,
          battle: battlePDA,
          escrow: escrowPDA,
          rentSysvar: SYSVAR_RENT_PUBKEY,
          systemProgram: SystemProgram.programId,
        },
        signers: [signer1],
      })
    );

    let [userBettingPDA2] = await PublicKey.findProgramAddress(
      [Buffer.from("bet"), signer2.publicKey.toBuffer()],
      program.programId
    );
    console.log("userBettingPDA2 = ", userBettingPDA2.toBase58());

    let left = { left: true };

    // signer2 bet on left with 2 sol
    await provider.connection.confirmTransaction(
      await program.rpc.bet(left, new BN(2000000000), {
        accounts: {
          authority: signer2.publicKey,
          admin: signer1.publicKey,
          userBetting: userBettingPDA2,
          battle: battlePDA,
          escrow: escrowPDA,
          clockSysvar: SYSVAR_CLOCK_PUBKEY,
          systemProgram: SystemProgram.programId,
        },
        signers: [signer2],
      })
    );

    let [userBettingPDA3] = await PublicKey.findProgramAddress(
      [Buffer.from("bet"), signer3.publicKey.toBuffer()],
      program.programId
    );
    console.log("userBettingPDA3 = ", userBettingPDA3.toBase58());

    let right = { right: true };

    // signer3 bet on right with 1 sol
    await provider.connection.confirmTransaction(
      await program.rpc.bet(right, new BN(1000000000), {
        accounts: {
          authority: signer3.publicKey,
          admin: signer1.publicKey,
          userBetting: userBettingPDA3,
          battle: battlePDA,
          escrow: escrowPDA,
          clockSysvar: SYSVAR_CLOCK_PUBKEY,
          systemProgram: SystemProgram.programId,
        },
        signers: [signer3],
      })
    );

    // admin(signer1) finalizes the battle (rng)
    await provider.connection.confirmTransaction(
      await program.rpc.finalize({
        accounts: {
          authority: signer1.publicKey,
          battle: battlePDA,
          clockSysvar: SYSVAR_CLOCK_PUBKEY,
          systemProgram: SystemProgram.programId,
        },
        signers: [signer1],
      })
    );

    let battle = await program.account.battle.fetch(battlePDA);
    console.log(
      "battle winner = ",
      battle.winner,
      battle.leftPool.toString(),
      battle.rightPool.toString()
    );

    let escrowbal = await provider.connection.getBalance(escrowPDA);
    console.log("escrowbal = ", escrowbal);

    // signer2 claims reward (this deletes user's betting account and distribute the reward to the team(==admin==signer1))
    await provider.connection.confirmTransaction(
      await program.rpc.claim({
        accounts: {
          authority: signer2.publicKey,
          admin: signer1.publicKey,
          userBetting: userBettingPDA2,
          battle: battlePDA,
          escrow: escrowPDA,
          clockSysvar: SYSVAR_CLOCK_PUBKEY,
          systemProgram: SystemProgram.programId,
        },
        signers: [signer2],
      })
    );

    console.log("left passed");
    escrowbal = await provider.connection.getBalance(escrowPDA);
    console.log("escrowbal = ", escrowbal);

    // signer3 claims reward (only deletes the betting account, no reward)
    await provider.connection.confirmTransaction(
      await program.rpc.claim({
        accounts: {
          authority: signer3.publicKey,
          admin: signer1.publicKey,
          userBetting: userBettingPDA3,
          battle: battlePDA,
          escrow: escrowPDA,
          clockSysvar: SYSVAR_CLOCK_PUBKEY,
          systemProgram: SystemProgram.programId,
        },
        signers: [signer3],
      })
    );
    escrowbal = await provider.connection.getBalance(escrowPDA);
    console.log("escrowbal = ", escrowbal);
  });
});
