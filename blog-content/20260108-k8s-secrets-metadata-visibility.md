---
toc: true
---
## k8s secrets, metadata, and visibility

over the last month, I've been exploring secrets in k8s in my spare time. this article is a rough summary of some of the ~interesting pieces of information I've found.


### k8s list vs. CSP list

(this wasn't new info to me - and might not be new info to you - but I think it's worth mentioning)

if you're familiar with Kubernetes (k8s), you probably know that the `list` RBAC verb works differently than the `list` action for many cloud service providers (CSPs). for example, in AWS, if a principal performs the `secretsmanager:ListSecrets` action, the AWS API returns a list of metadata for each secret. [AWS documentation](https://docs.aws.amazon.com/cli/latest/reference/secretsmanager/list-secrets.html) shows this example request and response: 

```
# request (using the CLI)
aws secretsmanager list-secrets

# response
{
    "SecretList": [
        {
            "ARN": "arn:aws:secretsmanager:us-west-2:123456789012:secret:MyTestSecret-a1b2c3",
            "Name": "MyTestSecret",
            "LastChangedDate": 1523477145.729,
            "SecretVersionsToStages": {
                "a1b2c3d4-5678-90ab-cdef-EXAMPLE11111": [
                    "AWSCURRENT"
                ]
            }
        },
        {
            "ARN": "arn:aws:secretsmanager:us-west-2:123456789012:secret:AnotherSecret-d4e5f6",
            "Name": "AnotherSecret",
            "LastChangedDate": 1523482025.685,
            "SecretVersionsToStages": {
                "a1b2c3d4-5678-90ab-cdef-EXAMPLE22222": [
                    "AWSCURRENT"
                ]
            }
        }
    ]
}
```

to retrieve the actual contents of the secret, a principal would need to perform the `secretsmanager:GetSecretValue` or `secretsmanager:BatchGetSecretValue` action (and potentially also the `kms:Decrypt` action). because AWS configures permissions this way, a principal who can perform a *list* action against a service might not be able to retrieve the underlying information of resources for that service. k8s works differently.

in k8s, when a principal performs a `list` action on a type of resource in a namespace, the API server returns *all* information about *all* applicable resources in that namespace (if the principal includes the `-o yaml` or `-o json` arguments). using my test cluster, when I run 

```
kubectl get secrets -n apply-secrets-demo -o yaml
```

the server returns:

```
apiVersion: v1
items:
- apiVersion: v1
  data:
    key: c2stbGl2ZS1hYmMxMjN4eXo3ODk=
  kind: Secret
  metadata:
    annotations:
      kubectl.kubernetes.io/last-applied-configuration: |
        {"apiVersion":"v1","kind":"Secret","metadata":{"annotations":{},"name":"api-key","namespace":"apply-secrets-demo"},"stringData":{"key":"sk-live-abc123xyz789"},"type":"Opaque"}
    creationTimestamp: "2025-12-11T04:00:09Z"
    name: api-key
    namespace: apply-secrets-demo
    resourceVersion: "44216657"
    uid: 7d10f04c-da16-404e-91f5-9e3bad3fc88c
  type: Opaque
- apiVersion: v1
  data:
    password: c3VwZXJzZWNyZXRwYXNzd29yZDEyMw==
    username: YWRtaW4=
  kind: Secret
  metadata:
    annotations:
      kubectl.kubernetes.io/last-applied-configuration: |
        {"apiVersion":"v1","kind":"Secret","metadata":{"annotations":{},"name":"db-credentials","namespace":"apply-secrets-demo"},"stringData":{"password":"supersecretpassword123","username":"admin"},"type":"Opaque"}
    creationTimestamp: "2025-12-11T04:00:09Z"
    name: db-credentials
    namespace: apply-secrets-demo
    resourceVersion: "44216656"
    uid: a1be0967-0dc3-450b-b9db-4de8c31dd083
  type: Opaque
kind: List
metadata:
  resourceVersion: ""
```

it's important to keep in mind that `list` permissions are more permissive in k8s than they ~typically are for many CSPs when assigning permissions for a cluster. this might not be new information to you if you're familiar with k8s, but even experienced cluster administrators can overlook this crucial distinction and accidentally grant more visibility to secret data than intended.


### k8s apply and the last-applied-configuration

now that I've discussed the `list` verb, I want to talk about a certain `kubectl` command - [`kubectl apply`](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_apply/)- and what happens when you use that command to create or edit a secret.

`kubectl apply` allows a user to specify a manifest (yaml or json that describes the configuration of an object or multiple objects in k8s) by filename or stdin that the server will use to create or modify an object (or objects). for example, to create the secrets shown in the section above, I used the following command:

```
kubectl apply -f demo.yaml
```

where demo.yaml defines multiple resources and can be found on my github [here](https://github.com/clholm/k8s-zone/blob/main/test-scenarios/apply-secrets/demo.yaml).

when a principal uses `kubectl apply` (without extra flags - see the section below about server-side apply for more information) to create or modify a resource, the server sets the `last-applied-configuration` annotation in the metadata to the *complete* configuration that was just applied. for secrets, this includes the actual secret data. for example:

```
kubectl get secrets -n apply-secrets-demo -o yaml
```

output:

```
apiVersion: v1
items:
- apiVersion: v1
  data:
    key: c2stbGl2ZS1hYmMxMjN4eXo3ODk=
  kind: Secret
  metadata:
    annotations:
      kubectl.kubernetes.io/last-applied-configuration: |
        {"apiVersion":"v1","kind":"Secret","metadata":{"annotations":{},"name":"api-key","namespace":"apply-secrets-demo"},"stringData":{"key":"sk-live-abc123xyz789"},"type":"Opaque"}
    creationTimestamp: "2025-12-11T04:00:09Z"
    name: api-key
    namespace: apply-secrets-demo
    resourceVersion: "44216657"
    uid: 7d10f04c-da16-404e-91f5-9e3bad3fc88c
  type: Opaque
- apiVersion: v1
  data:
    password: c3VwZXJzZWNyZXRwYXNzd29yZDEyMw==
    username: YWRtaW4=
  kind: Secret
  metadata:
    annotations:
      kubectl.kubernetes.io/last-applied-configuration: |
        {"apiVersion":"v1","kind":"Secret","metadata":{"annotations":{},"name":"db-credentials","namespace":"apply-secrets-demo"},"stringData":{"password":"supersecretpassword123","username":"admin"},"type":"Opaque"}
    creationTimestamp: "2025-12-11T04:00:09Z"
    name: db-credentials
    namespace: apply-secrets-demo
    resourceVersion: "44216656"
    uid: a1be0967-0dc3-450b-b9db-4de8c31dd083
  type: Opaque
kind: List
metadata:
  resourceVersion: ""
```

I can also run the following command to retrieve only the `last-applied-configuration` in a nicer format:

```
kubectl apply view-last-applied -n apply-secrets-demo secrets
```

output:

```
apiVersion: v1
kind: Secret
metadata:
  annotations: {}
  name: api-key
  namespace: apply-secrets-demo
stringData:
  key: sk-live-abc123xyz789
type: Opaque
apiVersion: v1
kind: Secret
metadata:
  annotations: {}
  name: db-credentials
  namespace: apply-secrets-demo
stringData:
  password: supersecretpassword123
  username: admin
type: Opaque
```

saving secret data in metadata might *seem* like an immediate security issue - but is it? according to k8s, they don't think so. in a reply to [this github issue](https://github.com/kubernetes/kubernetes/issues/29923), github user `liggitt` explains that

> Metadata is not treated as less confidential than main object content by encryption at rest or authorization.

ultimately, this means that k8s assumes any principal who can retrieve the metadata for an object *should* be able to see the underlying data, including secret data. similar to what I discussed in the previous section, this might seem strange if you're used to working with CSPs like AWS or Azure, which often draw a distinction between the permissions required to access the metadata of an object and those required to access the underlying object data. vanilla k8s doesn't give you this flexibility - if a principal can see an object's metadata, they should be able to see everything about the object too.


### github issues regarding secret data in the metadata

it turns out there are several github issues that relate to secret data being visible in metadata. here's a collection of the ones I've found:

* [kubectl apply leaks secret data #23564](https://github.com/kubernetes/kubernetes/issues/23564)
* [Secrets created with kubectl apply -f are available as clear text in "Annotations" #29923](https://github.com/kubernetes/kubernetes/issues/29923)
- [Allow listing secrets without disclosing secret data #78056](https://github.com/kubernetes/kubernetes/issues/78056)
	- in this issue, a user requests the ability to list secrets without revealing secret data
- [Accessing non-sensitive data of Secrets #86268](https://github.com/kubernetes/kubernetes/issues/86268)
	- this is similar to the previous issues

**there are also several issues related to secret visbility in metadata for various k8s tools:**

- `pulumi-kubernetes:` [last-applied-configuration contains plain text secret values #1118](https://github.com/pulumi/pulumi-kubernetes/issues/1118)
- `kapp`: [improve kubectl describe output of kapp managed secrets #90](https://github.com/carvel-dev/kapp/issues/90)
- `kube-applier:` [Output kubectl apply errors without leaking Secrets from annotations #118](https://github.com/utilitywarehouse/kube-applier/issues/118)
- `airshipctl`: [Secret stringData Encoding #424](https://github.com/airshipit/airshipctl/issues/424)

but I'm sure there could be even more that I didn't find with my brief google searches.


### avoiding secret data in metadata with server-side apply, and whether or not that matters

reading through the issues above, you might see a recurring mention of something called [`server-side apply`](https://kubernetes.io/docs/reference/using-api/server-side-apply/). when a principal uses a server-side apply to create or edit a resource, the control plane doesn't store the resource's configuration in the `last-applied-configuration` annotation. instead, it keeps track of the object's fields and its associated *field managers*. From the  [k8s docs](https://kubernetes.io/docs/reference/using-api/server-side-apply/#managers): 

> Managers identify distinct workflows that are modifying the object ... and can be specified through the [`fieldManager`](https://kubernetes.io/docs/reference/kubernetes-api/common-parameters/common-parameters/#fieldManager) query parameter as part of a modifying request.

for example, I can run 

```
kubectl apply --server-side --field-manager=test -f - <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: ssa-created-secret
  namespace: apply-secrets-demo
type: Opaque
stringData:
  my-key: my-secret-value
EOF
```

to create a secret with server-side apply. then, I can retrieve the data for that secret with:

```
kubectl get secret ssa-created-secret -n apply-secrets-demo -o yaml
```

and the server responds with the following:

```
apiVersion: v1
data:
  my-key: bXktc2VjcmV0LXZhbHVl
kind: Secret
metadata:
  creationTimestamp: "2026-01-08T03:47:31Z"
  name: ssa-created-secret
  namespace: apply-secrets-demo
  resourceVersion: "48672691"
  uid: fa0ed875-dfd3-49e9-b3bc-7d916c43e1a5
type: Opaque
```

notice how there's no `last-applied-configuration` annotation. side note - if I wanted to see the managed fields information, I could include the ` --show-managed-fields` flag with the `kubectl get` command above.

in essence, when a principal or controller performs a server-side apply, k8s trusts that principal/controller to maintain the configuration of the object (or at least the configuration of the fields they manage). this is why that information isn't stored in the `last-applied-configuration` annotation. [this blog post](https://kubernetes.io/blog/2022/10/20/advanced-server-side-apply/) describes some potential use-cases for server-side apply. regardless, using server-side apply prevents a secret's underlying data from being stored in its metadata.

does removing that underlying data from the secret's metadata matter, though? it depends on your cluster. as I mentioned earlier, by default k8s considers a secret's metadata as equally as confidential as the rest of its data - at rest or when making authz decisions. that means that by default, k8s assumes a principal that can retrieve (*or edit*[^1]) a secret's data *should* be able to see *all* of its data. unless your cluster is handling secrets in a non-standard way (maybe you use a custom operator and associated custom resources to separate secret metadata from secret data), there's currently no way in k8s to expose a secret's metadata to a principal without exposing the underlying data as well.

### conclusion

in summary

* in k8s, `list` works differently than `list` actions in many CSPs. in k8s, `list` causes the server to return *all* information about *all* applicable resources in a namespace (if the principal includes the `-o yaml` or `-o json` arguments).
* `kubectl apply` (without extra flags) causes the server to set the `last-applied-configuration` annotation in an object's metadata to the *complete* configuration that was applied. for secrets, this includes the actual secret data.
	* k8s does not consider this an issue, as there is no distinction between the confidentiality of the metadata and the confidentiality of the underlying - k8s treats them the same.
	* despite this behavior being the default (and therefore assumed understood) k8s behavior, there are several issues on github in the k8s repo as well as repos for k8s tools relating to secret data being visible in metadata.
* a `server-side apply` does not set the `last-applied-configuration`. however, unless you're handling k8s secrets in a non-standard way, this probably doesn't act as a security measure for your cluster's secrets. there's currently no way in (default) k8s to expose a secret's metadata to a principal without exposing the underlying data as well.

do I think k8s should change the way it handles metadata, especially secret metadata? I'm not sure! 

if k8s treated metadata as less confidential than the underlying data, users could grant principals access to just an object's metadata. for example, they would be able to grant a service account permission to list the metadata of secrets (but not the underlying secret data). in some environments, this additional flexibility could allow for further separation of privilege, and allow clusters to adhere to the principle of least privilege better.

however, this functionality change would require a fundamental (I think?) change to the k8s threat model, which the platform has been built on. I wouldn't be surprised if it isn't feasible due to the effort it would take, and I'm not sure if the tradeoff would be worth it. also, I'm sure the (much smarter than me) people maintaining k8s have already discussed this.

that's all I have for now! thanks for reading :)

[^1]: [for reference](<https://github.com/clholm/k8s-zone/blob/main/notes/202512190046 - k8s secret patch.md>). I hope to elaborate on this in a future post