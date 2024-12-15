/* eslint-disable @typescript-eslint/no-explicit-any */
const ApiResponseHandler = (
	success: boolean,
	statusCode: number,
	message: string | any
) => {
	return new Response(JSON.stringify({ success: success, data: message }), {
		status: statusCode,
		headers: { "Content-Type": "application/json" },
	});
};

export default ApiResponseHandler;
