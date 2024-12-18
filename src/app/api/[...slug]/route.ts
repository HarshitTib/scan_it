import ApiResponseHandler from "@/app/handlers/apiResponseHandler";

export async function GET() {
	return ApiResponseHandler(
		false,
		404,
		"The requested API route does not exist. Kindly check once again."
	);
}

export async function POST() {
	return ApiResponseHandler(
		false,
		404,
		"The requested API route does not exist. Kindly check once again."
	);
}

export async function PUT() {
	return ApiResponseHandler(
		false,
		404,
		"The requested API route does not exist. Kindly check once again."
	);
}

export async function DELETE() {
	return ApiResponseHandler(
		false,
		404,
		"The requested API route does not exist. Kindly check once again."
	);
}
