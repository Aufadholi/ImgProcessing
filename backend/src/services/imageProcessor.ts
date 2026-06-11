import sharp from "sharp";
import fs from "fs";
import path from "path";

export const processImage =
  async (
    inputFile: string,
    outputFile: string
  ) => {

    const dir = outputFile.substring(0, outputFile.lastIndexOf("/"));
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    await sharp(inputFile)
      .resize(1280, 1280, { fit: "inside", withoutEnlargement: true })
      .webp({
        quality: 80
      })
      .toFile(outputFile);

  };