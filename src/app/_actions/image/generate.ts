"use server";

import { env } from "@/env";
// import Together from "together-ai";
import { db } from "@/server/db";
import { auth } from "@/server/auth";
import { utapi } from "@/app/api/uploadthing/core";
import { UTFile } from "uploadthing/server";

// const together = new Together({ apiKey: env.NANO_BANANA_API_KEY });

// Model list not needed for NanoBanana, but keep type for compatibility
export type ImageModelList = string;

export async function generateImageAction(
  prompt: string,
  model?: ImageModelList // model is ignored for NanoBanana
) {
  // Get the current session
  const session = await auth();

  // Check if user is authenticated
  if (!session?.user?.id) {
    throw new Error("You must be logged in to generate images");
  }

  try {
    console.log(`Generating image with Google NanoBanana`);

    // Call Google NanoBanana API for image generation
    const nanoBananaResponse = await fetch("https://nanobanana.googleapis.com/v1/images:generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.NANO_BANANA_API_KEY}`,
      },
      body: JSON.stringify({
        prompt,
        width: 1024,
        height: 768,
        n: 1,
      }),
    });

    if (!nanoBananaResponse.ok) {
      throw new Error("Failed to generate image with Google NanoBanana");
    }

    const nanoBananaData = await nanoBananaResponse.json();
    // Assume response: { images: [{ url: string }] }
    const imageUrl = nanoBananaData.images?.[0]?.url;

    if (!imageUrl) {
      throw new Error("Failed to generate image");
    }

    console.log(`Generated image URL: ${imageUrl}`);

    // Download the image from NanoBanana URL
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error("Failed to download image from Google NanoBanana");
    }

    const imageBlob = await imageResponse.blob();
    const imageBuffer = await imageBlob.arrayBuffer();

    // Generate a filename based on the prompt
    const filename = `${prompt.substring(0, 20).replace(/[^a-z0-9]/gi, "_")}_${Date.now()}.png`;

    // Create a UTFile from the downloaded image
    const utFile = new UTFile([new Uint8Array(imageBuffer)], filename);

    // Upload to UploadThing
    const uploadResult = await utapi.uploadFiles([utFile]);

    if (!uploadResult[0]?.data?.ufsUrl) {
      console.error("Upload error:", uploadResult[0]?.error);
      throw new Error("Failed to upload image to UploadThing");
    }

    console.log(uploadResult);
    const permanentUrl = uploadResult[0].data.ufsUrl;
    console.log(`Uploaded to UploadThing URL: ${permanentUrl}`);

    // Store in database with the permanent URL
    const generatedImage = await db.generatedImage.create({
      data: {
        url: permanentUrl, // Store the UploadThing URL instead of the NanoBanana URL
        prompt: prompt,
        userId: session.user.id,
      },
    });

    return {
      success: true,
      image: generatedImage,
    };
  } catch (error) {
    console.error("Error generating image:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to generate image",
    };
  }
}
