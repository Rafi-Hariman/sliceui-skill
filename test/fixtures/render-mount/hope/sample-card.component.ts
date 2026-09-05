import { Component } from "@angular/core";

@Component({
  selector: "app-sample-card",
  templateUrl: "./sample-card.component.html",
  styleUrls: ["./sample-card.component.scss"],
})
export class SampleCardComponent {
  label = "Simpan count: 3";
  onSave(): void {
    // TODO: wire to service
  }
}
