import path from "path"
const d = new URL(".", import.meta.url).pathname;
console.log(path.resolve("..", d))
console.log(path.resolve(d,".."))
export default {}
