import {A, a} from "./mutual-a"

class B {
    a() {
        return new A()
    }
}
export {B}
export function ba() { return a + 26}