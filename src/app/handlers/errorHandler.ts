import { ZodError } from "zod";

export function handleErrorResponse(error: unknown): Response {
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
		JSON.stringify({
			success: false,
			message: error instanceof Error ? error.message : String(error),
		}),
		{
			status: 500,
			headers: { "Content-Type": "application/json" },
		}
	);
}
