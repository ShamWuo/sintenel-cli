import * as readline from "node:readline";
import { randomBytes } from "node:crypto";

export async function confirmYesNo(prompt: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const answer: string = await new Promise((res) => {
    rl.question(prompt, (line) => {
      res(line.trim());
    });
  });
  rl.close();
  const u = answer.toUpperCase();
  return u === "Y" || u === "YES";
}

export async function confirmApprovalChallenge(): Promise<boolean> {
  const token = randomBytes(4).toString("hex").toUpperCase();
  const prompt = `Type APPROVE ${token} to continue: `;
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const answer: string = await new Promise((res) => {
    rl.question(prompt, (line) => {
      res(line.trim());
    });
  });
  rl.close();
  return answer === `APPROVE ${token}`;
}
