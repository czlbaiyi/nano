package main

import (
	"net/http"

	"github.com/czlbaiyi/nano"
	"github.com/czlbaiyi/nano/serialize/json"
)

func main() {
	// override default serializer
	nano.SetSerializer(json.NewSerializer())

	http.Handle("/web-mobile/", http.StripPrefix("/web-mobile/", http.FileServer(http.Dir("web-mobile"))))

	nano.SetCheckOriginFunc(func(_ *http.Request) bool { return true })

	nano.ListenWS(":33251")
}
