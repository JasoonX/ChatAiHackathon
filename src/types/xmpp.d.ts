declare module "@xmpp/component" {
  export function component(options: {
    service: string;
    domain: string;
    password: string;
  }): any;
  export function xml(name: string, attrs?: Record<string, string>, ...children: any[]): any;
  export function jid(local: string, domain: string, resource?: string): any;
}

declare module "@xmpp/client" {
  export function client(options: {
    service: string;
    domain: string;
    username: string;
    password: string;
  }): any;
  export function xml(name: string, attrs?: Record<string, string>, ...children: any[]): any;
  export function jid(local: string, domain: string, resource?: string): any;
}

declare module "@xmpp/xml" {
  export function xml(name: string, attrs?: Record<string, string>, ...children: any[]): any;
}
