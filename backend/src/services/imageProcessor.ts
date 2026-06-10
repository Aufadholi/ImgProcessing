import sharp from "sharp";
import path from "path";

export const processImage =
  async (
    inputFile: string,
    outputFile: string
  ) => {

    await sharp(inputFile)
      .resize({
        width: 800
      })
      .webp({
        quality: 80
      })
      .toFile(outputFile);

  };