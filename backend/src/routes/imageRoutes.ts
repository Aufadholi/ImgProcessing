import { Router, Request, Response } from "express";

import { upload } from "../middleware/uploadMiddleware";

import {
  uploadImage,
  getJobStatus,
  downloadImage
} from "../controllers/imageControllers";

const router = Router();

/**
 * TEST ROUTE
 * http://localhost:3001/api/test
 */
router.get(
  "/test",
  (req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      message: "Image routes working"
    });
  }
);

/**
 * UPLOAD IMAGE
 * POST /api/upload
 */
router.post(
  "/upload",
  upload.single("image"),
  uploadImage
);

/**
 * JOB STATUS
 * GET /api/images/status/:id
 */
router.get(
  "/status/:id",
  getJobStatus
);

/**
 * DOWNLOAD RESULT
 * GET /api/download/:id
 */
router.get(
  "/download/:id",
  downloadImage
);

export default router;