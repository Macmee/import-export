import {B} from "./b"
export class A {
get b() {
	return new B()
}
}
