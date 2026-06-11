import sharp from "sharp";
import path from "path";

export const processImage =
  async (
    inputFile: string,
    outputFile: string
  ) => {

    await sharp(inputFile)
      .resize(1280, 1280, { fit: "inside", withoutEnlargement: true })
      .webp({
        quality: 80
      })
      .toFile(outputFile);

  };