export interface QueryString {
  selector: Selector;
}

export interface Selector {
  docType: string;
  color: string;
  owner: string;
}