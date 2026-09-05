import { NgModule } from "@angular/core";
import { BrowserModule } from "@angular/platform-browser";
import { UnderTestComponent } from "./under-test.component";
import { ChildComponent } from "./child.component";

@NgModule({
  declarations: [UnderTestComponent, ChildComponent],
  imports: [BrowserModule],
  bootstrap: [UnderTestComponent],
})
export class AppModule {}
