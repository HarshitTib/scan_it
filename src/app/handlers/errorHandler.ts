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
				status: StatusCode.BAD_REQUEST,
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
			status: StatusCode.INTERNAL_SERVER_ERROR,
			headers: { "Content-Type": "application/json" },
		}
	);
}
