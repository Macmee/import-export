import * as B from "./b"
export class A {
get b() {
	return new B.B()
}
}
