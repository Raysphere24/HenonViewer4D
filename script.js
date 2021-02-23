/** @type {HTMLCanvasElement} */
const canvas = document.getElementById("canvas");

const numVerticesDiv = document.getElementById("numVerticesDiv");

const xywRotationRadio = document.getElementById("xywRotationRadio");
const xzwRotationRadio = document.getElementById("xzwRotationRadio");

canvas.width = canvas.clientWidth * window.devicePixelRatio;
canvas.height = canvas.clientHeight * window.devicePixelRatio;

const modelFileName = "depth42.4pa";

/** @type {WebGLRenderingContext} */
const gl = canvas.getContext("webgl");

const vsSource = `
	attribute vec4 position;
	uniform mat4 view, proj;

	void main() {
		// 4D position
		vec4 pos = view * position;

		//3D view-space position (projective coordinates)
		vec4 viewPos = vec4(pos.xyz, 1);

		//3D clip-space position
		gl_Position = proj * viewPos;

		gl_PointSize = 1.0;
	}
`;

const fsSource = `
	void main() {
		gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
	}
`;

function loadShader(type, source) {
	const shader = gl.createShader(type);

	gl.shaderSource(shader, source);
	gl.compileShader(shader);

	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		console.log("Shader compile error: " + gl.getShaderInfoLog(shader));
		gl.deleteShader(shader);
		return null;
	}

	return shader;
}

function initShaderProgram(vsSource, fsSource) {
	const vertexShader = loadShader(gl.VERTEX_SHADER, vsSource);
	const fragmentShader = loadShader(gl.FRAGMENT_SHADER, fsSource);

	const shaderProgram = gl.createProgram();
	gl.attachShader(shaderProgram, vertexShader);
	gl.attachShader(shaderProgram, fragmentShader);
	gl.linkProgram(shaderProgram);

	if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
		console.log("Shader link error: " + gl.getProgramInfoLog(shaderProgram));
		return null;
	}

	return shaderProgram;
}

class Model {
	constructor() {
		this.buffer = gl.createBuffer();
	}

	init(/** @type {ArrayBuffer} */arrayBuffer, /** @type{number} */primitiveType) {
		this.stride = 16;
		this.primitiveType = primitiveType;

		gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
		gl.bufferData(gl.ARRAY_BUFFER, arrayBuffer, gl.STATIC_DRAW);

		this.numVertices = arrayBuffer.byteLength / this.stride;
	}

	draw() {
		gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
		gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);
		gl.enableVertexAttribArray(0);

		gl.drawArrays(this.primitiveType, 0, this.numVertices);
	}
}

const model = new Model();

function detectPrimitiveType(/** @type{string} */fileName) {
	const extension = fileName.split(".").pop().toLowerCase();

	if (extension === "4pa") return gl.POINTS;
	if (extension === "4la") return gl.LINES;
	if (extension === "4ta") return gl.TRIANGLES;

	return undefined;
}

function loadModelFromArrayBuffer(arrayBuffer, primitiveType) {
	if (arrayBuffer) {
		model.init(arrayBuffer, primitiveType);
		numVerticesDiv.textContent = model.numVertices.toLocaleString();
		update();
	}
}

function loadModelFromFile(fileName) {
	const httpRequest = new XMLHttpRequest();

	httpRequest.open("GET", fileName, true);
	httpRequest.responseType = "arraybuffer";

	httpRequest.onload = ev => {
		loadModelFromArrayBuffer(httpRequest.response, detectPrimitiveType(fileName));
	};

	httpRequest.send();
}

gl.clearColor(0, 0, 0, 1);
gl.enable(gl.DEPTH_TEST);

loadModelFromFile(modelFileName);

const shaderProgram = initShaderProgram(vsSource, fsSource);

gl.useProgram(shaderProgram);

const viewMatrixLocation = gl.getUniformLocation(shaderProgram, "view");
const projMatrixLocation = gl.getUniformLocation(shaderProgram, "proj");

let viewMatrix = [
	1, 0, 0, 0,
	0, 1, 0, 0,
	0, 0, 1, 0,
	0, 0, 0, 1,
];

const aspect = canvas.width / canvas.height;
const projMatrix = matProjection(aspect, 2.5, 5);

gl.uniformMatrix4fv(projMatrixLocation, false, projMatrix);

function render() {
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	gl.uniformMatrix4fv(viewMatrixLocation, false, viewMatrix);

	model.draw();

	gl.flush();
}

function update() {
	window.requestAnimationFrame(render);
}

/**
 * Multiply matrices A and B
 * @param {number[]} A 4x4 matrix
 * @param {number[]} B 4x4 matrix
 */
function matMultiply(A, B) {
	return [
		A[ 0] * B[ 0] + A[ 1] * B[ 4] + A[ 2] * B[ 8] + A[ 3] * B[12],
		A[ 0] * B[ 1] + A[ 1] * B[ 5] + A[ 2] * B[ 9] + A[ 3] * B[13],
		A[ 0] * B[ 2] + A[ 1] * B[ 6] + A[ 2] * B[10] + A[ 3] * B[14],
		A[ 0] * B[ 3] + A[ 1] * B[ 7] + A[ 2] * B[11] + A[ 3] * B[15],

		A[ 4] * B[ 0] + A[ 5] * B[ 4] + A[ 6] * B[ 8] + A[ 7] * B[12],
		A[ 4] * B[ 1] + A[ 5] * B[ 5] + A[ 6] * B[ 9] + A[ 7] * B[13],
		A[ 4] * B[ 2] + A[ 5] * B[ 6] + A[ 6] * B[10] + A[ 7] * B[14],
		A[ 4] * B[ 3] + A[ 5] * B[ 7] + A[ 6] * B[11] + A[ 7] * B[15],

		A[ 8] * B[ 0] + A[ 9] * B[ 4] + A[10] * B[ 8] + A[11] * B[12],
		A[ 8] * B[ 1] + A[ 9] * B[ 5] + A[10] * B[ 9] + A[11] * B[13],
		A[ 8] * B[ 2] + A[ 9] * B[ 6] + A[10] * B[10] + A[11] * B[14],
		A[ 8] * B[ 3] + A[ 9] * B[ 7] + A[10] * B[11] + A[11] * B[15],

		A[12] * B[ 0] + A[13] * B[ 4] + A[14] * B[ 8] + A[15] * B[12],
		A[12] * B[ 1] + A[13] * B[ 5] + A[14] * B[ 9] + A[15] * B[13],
		A[12] * B[ 2] + A[13] * B[ 6] + A[14] * B[10] + A[15] * B[14],
		A[12] * B[ 3] + A[13] * B[ 7] + A[14] * B[11] + A[15] * B[15],
	];
}

function matProjection(aspect, boundY, eyeZ) {
	const xx = eyeZ / (aspect * boundY);
	const nearZ = 0.5 * eyeZ;

	return [
		xx, 0, 0, 0,
		0, eyeZ / boundY, 0, 0,
		0, 0, -1, -1,
		0, 0, nearZ, eyeZ
	];
}

// Axis vector (x, y, z) must be normalized
function matRotation3D(x, y, z, angle) {
	const c = 1 - Math.cos(angle), s = Math.sin(angle);

	return [
		1 + c*(x*x-1), c*x*y + s*z, c*x*z - s*y, 0,
		c*y*x - s*z, 1 + c*(y*y-1), c*y*z + s*x, 0,
		c*z*x + s*y, c*z*y - s*x, 1 + c*(z*z-1), 0,
		0, 0, 0, 1
	];
}

// Axis vector (x, y, z) must be normalized
function matRotationVW(x, y, z, angle) {
	const c = Math.cos(angle) - 1, s = Math.sin(angle);

	return [
		1 + c*x*x, c*x*y, c*x*z, -s*x,
		c*y*x, 1 + c*y*y, c*y*z, -s*y,
		c*z*x, c*z*y, 1 + c*z*z, -s*z,
		s*x, s*y, s*z, 1 + c
	];
}

function rotateView(dx, dy) {
	const ds = Math.sqrt(dx*dx + dy*dy);

	if (ds === 0) return;

	const rotation =
		xzwRotationRadio.checked ?
			matRotationVW(dx/ds, 0, -dy/ds, ds):
		xywRotationRadio.checked ?
			matRotationVW(dx/ds, -dy/ds, 0, ds):
			matRotation3D(dy/ds, dx/ds, 0, ds);

	viewMatrix = matMultiply(viewMatrix, rotation);

	update();
}

document.addEventListener("dragover", ev => {
	ev.stopPropagation();
	ev.preventDefault();
	ev.dataTransfer.dropEffect = "copy";
})

document.addEventListener("drop", ev => {
	ev.stopPropagation();
	ev.preventDefault();

	const file = ev.dataTransfer.files[0];

	const primitiveType = detectPrimitiveType(file.name);
	if (primitiveType === undefined) return;

	const reader = new FileReader();

	reader.onload = ev => {
		loadModelFromArrayBuffer(reader.result, primitiveType);
	};

	reader.readAsArrayBuffer(file);
}, false);

canvas.onmousemove = ev => {
	// ignore other than only left button is pressed
	if (ev.buttons !== 1) return;

	const dx = ev.movementX / 128;
	const dy = ev.movementY / 128;

	rotateView(dx, dy);
};

canvas.onwheel = ev => {
	const dx = ev.deltaX / -256;
	const dy = ev.deltaY / -256;

	rotateView(dx, dy);

	ev.preventDefault();
};

let prevTouchX = 0, prevTouchY = 0;

canvas.ontouchstart = ev => {
	if (ev.touches.length === 1) {
		prevTouchX = ev.touches[0].clientX;
		prevTouchY = ev.touches[0].clientY;
	}
};

canvas.ontouchend = canvas.ontouchstart;

canvas.ontouchmove = ev => {
	if (ev.touches.length === 1) {
		const x = ev.touches[0].clientX;
		const y = ev.touches[0].clientY;

		const dx = (x - prevTouchX) / 128;
		const dy = (y - prevTouchY) / 128;

		rotateView(dx, dy);

		prevTouchX = x;
		prevTouchY = y;
	}

	ev.preventDefault();
};
