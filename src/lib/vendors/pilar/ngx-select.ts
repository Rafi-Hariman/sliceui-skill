// <ngx-select> comes from ngx-select-ex, re-exported by pilar's PilarModule
// (pilar.module.ts imports + exports NgxSelectModule) — import PilarModule or NgxSelectModule.
import { NgxSelectModule } from "ngx-select-ex";
// items: string[] or [{ id, text }] (optionTextField/optionValueField for objects):
// <ngx-select [items]="items" [optionTextField]="'name'" [optionValueField]="'value'">
// Style to match the design: the toggle is .ngx-select__toggle (::ng-deep shim may be needed).