resource "local_file" "inventory" {
  filename = "${path.module}/../ansible/inventory.ini" 
  content  = templatefile("${path.module}/../ansible/inventory.tpl", {
    public_ip = module.azure_infrastructure.public_ip
  })
}

