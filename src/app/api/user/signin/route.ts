/* eslint-disable @typescript-eslint/no-explicit-any */
import User from "@/models/user.model";
import { connectDB } from "@/app/lib/mongoose";
import z, { ZodError } from "zod";
import jwt from "jsonwebtoken";
import bycrpt from "bcryptjs";

const signInSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
});


export async function POST(req: any) {
    try {
        await connectDB();
        const body = await req.json()  // Accessing body from req
        const password = body.password;
        const hashedPassword = bycrpt.hashSync(password, 10);
        body.password = hashedPassword

        const data = signInSchema.parse(body);  // Validating request body
        
        const response = await User.findOne(data);  // Creating user in DB
        if (!response || response.deleted) {
          return new Response(JSON.stringify({ success: false, message: "User not created" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
        const secret = process.env.ADMIN_JWT_SECRET;
        if (!secret) {
          return new Response(JSON.stringify({ success: false, message: "JWT secret is not defined" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
        const id = response._id;
        const token = jwt.sign({ id }, secret);
        
        return new Response(JSON.stringify({ success: true, message: token }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });

    } catch (error) {
      if (error instanceof ZodError) {
        return new Response(
            JSON.stringify({
                success: false,
                message: "Validation Error",
                issues: error.errors, // Provide detailed validation errors
            }),
            {
                status: 400,
                headers: { "Content-Type": "application/json" },
            }
        );
    }
    return new Response(
        JSON.stringify({ success: false, message: error instanceof Error ? error.message : String(error) }),
        {
            status: 500,
            headers: { "Content-Type": "application/json" },
        }
    );
    }
}