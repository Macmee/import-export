import {B} from "./mutual-b"

class A {
    b() {
        return new B()
    }
}
export {A}