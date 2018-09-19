import { Nano } from "./Nano"

const { ccclass, property } = cc._decorator;

@ccclass
export default class Helloworld extends cc.Component {

    @property(cc.Label)
    label: cc.Label = null;

    @property
    text: string = 'hello';

    start() {
        // init logic
        this.label.string = this.text;
        Nano.init({ host: "127.0.0.1", port: 33251 }, ()=>{
            this.label.string = "connect success"
        }, this)
    }
}
