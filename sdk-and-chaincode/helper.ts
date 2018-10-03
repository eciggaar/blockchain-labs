export class Helper {
  public constructor() {}

  public sleep(milliseconds: number): Promise<void> {
    console.log(`Sleeping for ${milliseconds} ms`);
    return new Promise<void>((resolve: Function) => {
      setTimeout(() => resolve(), milliseconds);
    });
  }

  public warn(message: string): void {
    console.warn(`\x1b[33m[Warning] ${message} \x1b[0m`);
  }

  public error(message: string): void {
    console.error(`\x1b[31m[Error] ${message} \x1b[0m`);
  }

  public debug(message: string): void {
    console.log(message);
  }
}