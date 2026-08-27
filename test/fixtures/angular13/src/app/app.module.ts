import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { HeroComponent } from "./features/hero/hero.component";

@NgModule({
  declarations: [HeroComponent],
  imports: [CommonModule, RouterModule.forRoot([])],
})
export class AppModule {}
